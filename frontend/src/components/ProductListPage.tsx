import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Product } from "../interfaces/Product";

const ProductListPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = `${import.meta.env.VITE_API_URL}/api/products`;
        console.log(`Workspaceing product from: ${apiUrl}`);

        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch products: ${response.statusText} Status: ${response.status}`
          );
        }

        const data: Product[] = await response.json();
        setProducts(data);
      } catch (error: unknown) {
        console.error("Error fetching products: ", error);
        let message = "An unknown error occurred while fetching products.";
        if (error instanceof Error) {
          message = error.message;
        } else if (typeof error === "string") {
          message = error;
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
          <Grid key={product._id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Link
              component={RouterLink}
              to={`/products/${product._id}`}
              underline="none"
            >
              <Card
                sx={{
                  "height": "100%",
                  "display": "flex",
                  "flexDirection": "column",
                  "transition": "transform 0.2s ease-in-out",
                  "&:hover": { transform: "scale(1.03)" },
                }}
              >
                <CardMedia
                  component="img"
                  image={
                    product.imageUrl ||
                    "https://www.placehold.co/300x200.png?text=No+Image"
                  }
                  alt={product.name}
                  sx={{ height: "200", objectFit: "cover" }}
                />
                <CardContent>
                  <Typography gutterBottom variant="h6" component="p" noWrap>
                    {product.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Category: {product.category}
                  </Typography>
                  <Typography variant="h5" component="p" sx={{ mt: 1 }}>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                    }).format(product.price)}
                  </Typography>
                </CardContent>
              </Card>
            </Link>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default ProductListPage;
