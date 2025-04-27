import { AlertColor } from "@mui/material";
import { ReactNode } from "react";

export interface SnackbarOptions {
  message: string;
  severity?: AlertColor;
}

export interface SnackbarContextType {
  showSnackbar: (option: SnackbarOptions) => void;
}

export interface SnackbarProviderProps {
  children: ReactNode;
}
