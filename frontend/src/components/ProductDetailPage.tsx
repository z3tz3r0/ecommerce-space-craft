import { AddShoppingCart } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Product } from "../interfaces/Product";

const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setError("Product doesn't existed.");
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      setProduct(null);

      try {
        const apiUrl = `${
          import.meta.env.VITE_API_URL
        }/api/products/${productId}`;
        console.log(`Workspaceing product from: ${apiUrl}`);

        const response = await fetch(apiUrl);

        if (response.status === 404) {
          throw new Error("Product not found");
        }
        if (!response.ok) {
          throw new Error(
            `Failed to fetch product: ${response.statusText} (Status: ${response.status})`
          );
        }

        const data: Product = await response.json();
        setProduct(data);
      } catch (error: unknown) {
        console.error("Error fetching product: ", error);
        let message = "An unknown error occurred.";
        if (error instanceof Error) {
          message = error.message;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  const handleAddToCart = () => {
    if (product) {
      console.log(`Adding ${product.name} to cart (To be done later)`);
    }
  };

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
        {error === "Product not found" ? (
          <Alert severity="warning" sx={{ mt: 4 }}>
            Could not find the requested spacecraft.
          </Alert>
        ) : (
          <Alert severity="error" sx={{ mt: 4 }}>
            Error loading product: {error}
          </Alert>
        )}
        <Button
          variant="outlined"
          onClick={() => navigate("/products")}
          sx={{ mt: 2 }}
        >
          Back to Products
        </Button>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container>
        <Alert severity="info" sx={{ mt: 4 }}>
          Product data is unavailable.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Grid container spacing={4}>
          {/* Image column */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              component="img"
              sx={{
                width: "100%",
                maxHeight: "500px",
                objectFit: "contain",
                borderRadius: 1,
              }}
              src={
                product.imageUrl || "https://placehold.co/600x400?text=No+Image"
              }
              alt={product.name}
            />
          </Grid>

          {/* Detail Column */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Chip label={product.category} color="primary" sx={{ mb: 2 }} />
            <Typography variant="h3" component="h1" gutterBottom>
              {product.name}
            </Typography>
            <Typography variant="h5" color="textSecondary" gutterBottom>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
              }).format(product.price)}
              ;
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Typography variant="body1" component="p">
              {product.description}
            </Typography>
            <Divider sx={{ my: 2 }} />

            {/* Specs */}
            <Typography variant="h6" gutterBottom>
              Specifications
            </Typography>
            <Box sx={{ pl: 2 }}>
              {product.specs?.manufacturer && (
                <Typography variant="body2">
                  Manufacturer: {product.specs.manufacturer}
                </Typography>
              )}
              {product.specs?.crewAmount && (
                <Typography variant="body2">
                  Crew Amount: {product.specs.crewAmount}
                </Typography>
              )}
              {product.specs?.maxSpeed && (
                <Typography variant="body2">
                  Max Speed: {product.specs.maxSpeed}
                </Typography>
              )}
            </Box>
            <Divider sx={{ my: 2 }} />

            {/* Stock & Cart */}
            <Typography variant="h6" component="p" sx={{ mt: 2 }}>
              {product.stockQuantity > 0
                ? `in Stock (${product.stockQuantity} available)`
                : `Out of Stock`}
            </Typography>

            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<AddShoppingCart />}
              onClick={handleAddToCart}
              disabled={product.stockQuantity === 0}
              sx={{
                mt: 3,
                mb: 2,
                width: { xs: "100%", sm: "auto" },
              }}
            >
              Add to Cart
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default ProductDetailPage;
