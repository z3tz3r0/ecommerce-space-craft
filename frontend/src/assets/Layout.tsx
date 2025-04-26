import { AppBar, Box, Container, Toolbar, Typography } from "@mui/material";
import { Outlet, Link as RouterLink } from "react-router-dom";

const Layout: React.FC = () => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      {/* ------ Top Navigation Bar ------ */}
      <AppBar position="static">
        <Toolbar variant="dense">
          <RouterLink
            to="/"
            style={{
              textDecoration: "none",
              color: "inherit",
              flexGrow: 1,
            }}
          >
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Spacecraft Store
            </Typography>
          </RouterLink>
        </Toolbar>
      </AppBar>
      {/* ------ Main Content Area ------ */}
      <Container component="main" sx={{ my: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>

      {/* ------ Footer ------ */}
      <Box
        component="footer"
        sx={{
          py: 2,
          mt: "auto",
          bgcolor: (theme) =>
            theme.palette.mode === "light"
              ? theme.palette.grey[200]
              : theme.palette.grey[800],
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="body2" color="textSecondary" align="center">
            {"© "}
            {new Date().getFullYear()}
            {" Spacecraft E-commerce. Blast Off! 🚀🧑‍🚀🌙"}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
