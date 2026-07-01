import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User, RevokedToken } from '../../database/entities';
import { LicensingService } from '../licensing/licensing.service';

const BCRYPT_COST = 12; // Section 6.4: cost factor >= 12
const ACCESS_TTL_SECONDS = 60 * 15; // 15 minutes
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AccessPayload {
  sub: string; // user_id
  email: string;
  license_status: string;
  type: 'access';
  jti: string;
}
export interface RefreshPayload {
  sub: string; // user_id
  type: 'refresh';
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RevokedToken) private readonly revokedRepo: Repository<RevokedToken>,
    private readonly jwt: JwtService,
    private readonly licensing: LicensingService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Email already registered' });
    }
    const password_hash = await bcrypt.hash(password, BCRYPT_COST);
    const user = this.userRepo.create({ email: email.toLowerCase(), password_hash });
    await this.userRepo.save(user);
    const { accessToken, refreshToken, refreshJti } = await this.issueTokens(user.id, 'none');
    return { user, accessToken, refreshToken, refreshJti };
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    const licenseStatus = await this.licensing.getUserLicenseStatus(user.id);
    const { accessToken, refreshToken, refreshJti } = await this.issueTokens(user.id, licenseStatus);
    return { user, accessToken, refreshToken, refreshJti, licenseStatus };
  }

  /** Mints a fresh access token from a valid refresh token cookie. */
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException({ code: 'NO_REFRESH_TOKEN', message: 'Missing refresh token' });
    }
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' });
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Malformed refresh token' });
    }
    const revoked = await this.revokedRepo.findOne({ where: { jti: payload.jti } });
    if (revoked) {
      throw new UnauthorizedException({ code: 'REVOKED_TOKEN', message: 'Refresh token revoked' });
    }
    const licenseStatus = await this.licensing.getUserLicenseStatus(payload.sub);
    const { accessToken } = await this.issueTokens(payload.sub, licenseStatus);
    return { accessToken };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
      if (payload.jti) {
        const exists = await this.revokedRepo.findOne({ where: { jti: payload.jti } });
        if (!exists) {
          await this.revokedRepo.save(
            this.revokedRepo.create({ jti: payload.jti, expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) }),
          );
        }
      }
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  async activateLicense(userId: string, licenseKey: string) {
    const license = await this.licensing.activateLicenseForUser(userId, licenseKey);
    return { status: license.status, activated_at: license.activated_at };
  }

  /** Verifies the bcrypt hash — exposed for the LocalStrategy password check. */
  validatePassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }

  async getUserWithPassword(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  private async issueTokens(userId: string, licenseStatus: string) {
    const refreshJti = randomUUID();
    const accessPayload: AccessPayload = {
      sub: userId,
      email: '',
      license_status: licenseStatus,
      type: 'access',
      jti: randomUUID(),
    };
    const refreshPayload: RefreshPayload = { sub: userId, type: 'refresh', jti: refreshJti };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: ACCESS_TTL_SECONDS,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: REFRESH_TTL_SECONDS,
    });
    return { accessToken, refreshToken, refreshJti };
  }

  ACCESS_TTL_SECONDS = ACCESS_TTL_SECONDS;
  REFRESH_TTL_SECONDS = REFRESH_TTL_SECONDS;
}
