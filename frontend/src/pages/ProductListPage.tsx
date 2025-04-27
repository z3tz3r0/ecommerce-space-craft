import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import React, { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import { Product } from "../interfaces/Product";
import { getAllProducts } from "../services/api";

const ProductListPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log("Fetching all products via service...");
        const data = await getAllProducts();
        setProducts(data);
      } catch (error: unknown) {
        console.error("Error fetching products: ", error);
        let message = "An unknown error occurred while fetching products.";
        if (error instanceof Error) {
          message = error.message;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Container maxWidth="sm">
        <Alert severity="error" sx={{ mt: 4 }}>
          {error}
        </Alert>
      </Container>
    );
  }
  return (
    <Container>
      <Typography variant="h4" component="h1" gutterBottom sx={{ my: 4 }}>
        Available Spacecraft
      </Typography>
      <Grid container spacing={4}>
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </Grid>
    </Container>
  );
};

export default ProductListPage;
