import { NextFunction, Request, Response } from "express";
import querystring from "querystring";

import { Authenticator, User } from "../types/user";
import { AuthenticatedSession } from "../types/session";
import { AuthenticatedRequest } from "../types/express";

export function signIn(
  req: Request,
  user: User,
  credential: Authenticator
): void {
  req.session = req.session || {};

  // update session
  req.session.authentication = <AuthenticatedSession>{
    user: {
      id: user.id,
      username: user.username,
    },
    credential,
    time: Date.now(),
  };

  // clear old session values
  delete req.session.registration;
  delete req.session.return_to;
}

// middleware

export function auth() {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ) => {
    const authentication: AuthenticatedSession = req?.session?.authentication;

    // FUTURE: only set user if session hasn't expired
    if (authentication?.time) {
      req.user = authentication.user;
      req.credential = authentication.credential;
    }

    return next();
  };
}

export function requiresAuth() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      // redirect to login page
      const return_to = req.originalUrl;
      return res.redirect(`/login?${querystring.stringify({ return_to })}`);
    }

    return next();
  };
}
