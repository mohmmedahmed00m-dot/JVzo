import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';
import { AccessPayload, AuthenticatedUser } from './auth.types';

/**
 * Verifies Access Tokens (Bearer header). Attaches the authenticated user to
 * request.user. The license_status here reflects issuance time; LicenseGuard
 * re-checks the live DB status per request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: AccessPayload): Promise<AuthenticatedUser> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User no longer exists' });
    }
    return {
      id: user.id,
      email: user.email,
      license_status: payload.license_status ?? 'none',
    };
  }
}
