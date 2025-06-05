import { Strategy as OAuth2Strategy } from 'passport-oauth2';

declare module 'passport-microsoft' {
  export interface StrategyOptionsWithRequest {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
    state?: boolean;
    passReqToCallback?: boolean;
  }

  /**
   *
   */
  export class Strategy extends OAuth2Strategy {
    /**
     *
     */
    constructor(
      options: StrategyOptionsWithRequest,
      verify: (
        req: any,
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (err: any, user?: any) => void
      ) => void
    );
  }
}
