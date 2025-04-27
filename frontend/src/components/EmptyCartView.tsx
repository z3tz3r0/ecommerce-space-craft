import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";

const EmptyCartView = () => {
  return (
    <Container>
      <Typography></Typography>
      <Button
        variant="contained"
        color="primary"
        component={RouterLink}
        to="/products"
      >
        Browse Products
      </Button>
    </Container>
  );
};

export default EmptyCartView;
