import { Box, Button } from "@mui/material";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";

const HomePage = () => {
  return (
    <Container maxWidth="md" sx={{ textAlign: "center", mt: 8 }}>
      <Typography variant="h2" component="h1" gutterBottom>
        Welcome to the Spacecraft Store!
      </Typography>
      <Typography variant="h5" component="p" color="textSecondary">
        Explore the galaxy's finest selection of interstellar vehicles.
      </Typography>
      <Box sx={{ mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          component={RouterLink}
          to="/products"
        >
          Browse Spacecraft
        </Button>
      </Box>
    </Container>
  );
};

export default HomePage;
