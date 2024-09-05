import { loginErrorMessage } from "./error.server";

export interface LoginErrorMessage {
  shop?: string;
}

export type LoginErrorResp = {
  errors: LoginErrorMessage;
  polarisTranslations?: any;
}

