import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";
import { Product } from "../interfaces/Product";

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
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
  );
};

export default ProductCard;
