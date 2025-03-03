import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenBlacklistService {
  private blacklistedTokens: Set<string> = new Set();

  constructor(private readonly verificationJwtService: JwtService) {}

  public blacklistToken(token: string): void {
    this.blacklistedTokens.add(token);
    this.cleanupBlacklistedTokens();
  }

  private cleanupBlacklistedTokens(): void {
    for (const token of this.blacklistedTokens) {
      try {
        this.verificationJwtService.verify(token);
      } catch (error) {
        // Jika token sudah kadaluarsa, hapus dari daftar hitam
        this.blacklistedTokens.delete(token);
      }
    }
  }

  public isTokenBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }
}
