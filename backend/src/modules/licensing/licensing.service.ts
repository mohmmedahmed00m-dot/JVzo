import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { randomUUID, timingSafeEqual, createHash } from 'crypto';
import { License, User } from '../../database/entities';
import { NotificationsService } from '../notifications/notifications.service';

export interface JvzooIpnPayload {
  [key: string]: string;
}

/** Constant-time string comparison (defends signature checks against timing attacks). */
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class LicensingService {
  private readonly logger = new Logger('Licensing');

  constructor(
    @InjectRepository(License) private readonly licenseRepo: Repository<License>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Returns the live license status for a user ('none' if no license linked). */
  async getUserLicenseStatus(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['license'],
    });
    if (!user) return 'none';
    if (!user.license) return 'none';
    return user.license.status; // active / revoked / refunded
  }

  /** Validates a license key exists and is active. */
  async validateLicenseKey(licenseKey: string): Promise<License> {
    const license = await this.licenseRepo.findOne({ where: { license_key: licenseKey } });
    if (!license) {
      throw new BadRequestException({ code: 'INVALID_LICENSE', message: 'Invalid license key' });
    }
    if (license.status !== 'active') {
      throw new BadRequestException({
        code: 'LICENSE_NOT_ACTIVE',
        message: `License is ${license.status}`,
      });
    }
    return license;
  }

  /** Links a license to a user and stamps activated_at (Section 6.3 flow). */
  async activateLicenseForUser(userId: string, licenseKey: string): Promise<License> {
    return this.dataSource.transaction(async (mgr) => {
      const license = await this.validateLicenseKey(licenseKey);
      const user = await mgr.findOne(User, { where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      if (user.license_id && user.license_id !== license.id) {
        throw new BadRequestException({
          code: 'LICENSE_ALREADY_LINKED',
          message: 'This account already has a different license linked',
        });
      }

      // Both writes in ONE transaction (audit fix #7): a partial failure now
      // rolls back, leaving no inconsistent user/license link.
      user.license_id = license.id;
      if (!license.activated_at) license.activated_at = new Date();
      await mgr.save(user);
      await mgr.save(license);
      this.logger.log(`License ${license.license_key} activated for user ${userId}`);
      return license;
    });
  }

  /**
   * JVZoo IPN verification (Section 6.1). Implements JVZoo's standard cverify
   * algorithm: sort all params except 'cverify' by key, concatenate values,
   * append the JVZOO_SECRET_KEY, MD5 the result, compare to received cverify.
   * Comparison is CONSTANT-TIME (timingSafeEqual) to prevent signature forgery.
   */
  verifyJvzooSignature(payload: JvzooIpnPayload, secret: string): boolean {
    const received = payload['cverify'];
    if (!received) return false;
    const fields = { ...payload };
    delete fields['cverify'];
    const keys = Object.keys(fields).sort();
    const concatenated = keys.map((k) => fields[k] ?? '').join('') + secret;
    const computed = createHash('md5').update(concatenated).digest('hex');
    return safeEqualHex(computed.toLowerCase(), received.toLowerCase());
  }

  /**
   * Processes a JVZoo INS payload after signature verification.
   *  - SALE: create an active License, idempotent on jvzoo_transaction_id.
   *    The UNIQUE partial index guarantees exactly one license per txn even
   *    under concurrent IPN delivery; a duplicate insert is resolved to the
   *    already-stored license (audit fix #2/#3).
   *  - REFUND / CGBK: revoke the License by transaction id within a single
   *    transaction (audit fix #10). Cascade access revocation is enforced by
   *    LicenseGuard reading the live DB status on each protected request.
   */
  async handleJvzooIpn(payload: JvzooIpnPayload): Promise<{ status: string }> {
    const txnType = (payload['ctransaction'] || '').toUpperCase();
    const txnId = payload['ctransreceipt'] || '';
    const customerEmail = payload['ccustemail'] || '';

    this.logger.log(`JVZoo IPN received: txnType=${txnType} txnId=${txnId}`);

    if (txnType === 'SALE') {
      const existing = txnId
        ? await this.licenseRepo.findOne({ where: { jvzoo_transaction_id: txnId } })
        : null;
      let license = existing;
      if (!license) {
        const licenseKey = this.generateLicenseKey();
        const candidate = this.licenseRepo.create({
          license_key: licenseKey,
          source: 'jvzoo',
          jvzoo_transaction_id: txnId || null,
          status: 'active',
        });
        try {
          // Insert within a transaction. The DB UNIQUE index is the final
          // idempotency guard: a concurrent duplicate insert throws 23505 and
          // we resolve to the already-stored license.
          license = await this.dataSource.transaction(async (mgr) => mgr.save(candidate));
          this.logger.log(`Created license ${license.license_key} for txn ${txnId}`);
        } catch (err) {
          if (err instanceof QueryFailedError && (err as any).code === '23505' && txnId) {
            license = await this.licenseRepo.findOne({ where: { jvzoo_transaction_id: txnId } });
            this.logger.log(`Idempotent: license for txn ${txnId} already existed`);
          } else {
            throw err;
          }
        }
      }
      if (license && customerEmail) {
        await this.notifications.sendLicenseKey(customerEmail, license.license_key);
      }
      return { status: 'ok' };
    }

    if (txnType === 'REFUND' || txnType === 'CGBK') {
      const finalStatus = txnType === 'REFUND' ? 'refunded' : 'revoked';
      await this.dataSource.transaction(async (mgr) => {
        const license = txnId
          ? await mgr.findOne(License, { where: { jvzoo_transaction_id: txnId } })
          : null;
        if (license) {
          license.status = finalStatus;
          await mgr.save(license);
          this.logger.warn(`License ${license.license_key} set to ${finalStatus} (txn ${txnId})`);
        } else {
          this.logger.warn(`Refund/chargeback for unknown txn ${txnId}`);
        }
      });
      return { status: 'ok' };
    }

    this.logger.log(`JVZoo IPN ignored (txnType=${txnType})`);
    return { status: 'ignored' };
  }

  private generateLicenseKey(): string {
    // Human-friendly, unguessable license key: ALK-XXXX-XXXX-XXXX-XXXX
    const part = () => randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
    return `ALK-${part()}-${part()}-${part()}-${part()}`;
  }
}
