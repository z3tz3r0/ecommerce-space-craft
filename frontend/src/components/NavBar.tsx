import ShoppingCart from "@mui/icons-material/ShoppingCart";
import {
  AppBar,
  Badge,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import React from "react";
import { NavigateFunction, Link as RouterLink } from "react-router-dom";

interface NavBarProps {
  totalItems: number;
  navigate: NavigateFunction;
}

const NavBar: React.FC<NavBarProps> = ({ totalItems, navigate }) => {
  return (
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
          <Typography variant="h6" component="span">
            Spacecraft Store
          </Typography>
        </RouterLink>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          color="inherit"
          component={RouterLink}
          to="/products"
          sx={{ mr: 1 }}
        >
          Products
        </Button>

        <IconButton
          size="large"
          aria-label={`show ${totalItems} item in cart`}
          color="inherit"
          onClick={() => navigate("/cart")}
        >
          <Badge badgeContent={totalItems} color="error">
            <ShoppingCart />
          </Badge>
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;
