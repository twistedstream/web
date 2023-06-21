import { UserVerificationRequirement } from "@simplewebauthn/typescript-types";
import { User } from "./user";
import { Authenticator } from "./user";

export interface RegisteringSession {
  registeringUser: User;
  challenge: string;
}

export interface AuthenticatingSession {
  authenticatingUser?: User;
  userVerification?: UserVerificationRequirement;
  challenge: string;
}

export interface AuthenticatedSession {
  user: User;
  credential: Authenticator;
  time: number;
}
