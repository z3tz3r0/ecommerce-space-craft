import { Alert, AlertColor, Snackbar } from "@mui/material";
import { SyntheticEvent, useState } from "react";
import { SnackbarOptions, SnackbarProviderProps } from "../interfaces/Snack";
import { SnackbarContext } from "./snackbarHooks";

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AlertColor>("info");

  const showSnackbar = ({ message, severity = "info" }: SnackbarOptions) => {
    setMessage(message);
    setSeverity(severity);
    setOpen(true);
  };

  const handleClose = (_event?: SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  const value = { showSnackbar };
  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          sx={{
            width: "100%",
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};
