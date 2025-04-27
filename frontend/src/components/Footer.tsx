import { Box, Container, Typography } from "@mui/material";

const Footer = () => {
  return (
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
        <Typography variant="body2" color="text.secondary" align="center">
          {"© "}
          {new Date().getFullYear()}
          {" Spacecraft E-commerce. Blast Off! 🚀🧑‍🚀🌙"}
        </Typography>
      </Container>
    </Box>
  );
};

export default Footer;
