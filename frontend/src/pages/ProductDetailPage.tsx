import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Package, Check, X } from "lucide-react";
import { fetchProduct, deleteProduct, updateVariant } from "@/lib/api";
import type { ProductDetail, Variant } from "@/types";
import { formatPrice, cn } from "@/lib/utils";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProduct(Number(id))
      .then((r) => r.json())
      .then(setProduct)
      .catch(console.error);
  }, [id]);

  // Delete handler — sends soft-delete request.
  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this product?"))
      return;
    setDeleting(true);
    try {
      await deleteProduct(Number(id));
      navigate("/products");
    } catch {
      setDeleting(false);
    }
  };

  // Callback for when a variant is updated inline
  const handleVariantUpdated = (updated: Variant) => {
    setProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        variants: prev.variants.map((v) => (v.id === updated.id ? updated : v)),
      };
    });
  };

  if (!product) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      {/* Product header — card style */}
      <div className="mb-6 rounded-lg border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {product.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  product.status === "active"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : product.status === "draft"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-100 text-gray-600"
                )}
              >
                {product.status}
              </span>
              {product.category_name && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {product.category_name}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Variants table — card wrapped like CatalogList */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Variants ({product.variants.length})
        </h2>

        <div className="overflow-hidden rounded-lg border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b bg-muted/50 transition-colors">
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    SKU
                  </th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="h-12 px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Price
                  </th>
                  <th className="h-12 px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Inventory
                  </th>
                  <th className="h-12 px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {product.variants.map((v) => (
                  <VariantRow key={v.id} variant={v} onUpdated={handleVariantUpdated} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VariantRow({
  variant,
  onUpdated,
}: {
  variant: Variant;
  onUpdated: (v: Variant) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [priceCents, setPriceCents] = useState(String(variant.price_cents));
  const [inventoryCount, setInventoryCount] = useState(String(variant.inventory_count));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lowStock =
    variant.inventory_count > 0 && variant.inventory_count <= 10;
  const outOfStock = variant.inventory_count === 0;

  const startEdit = () => {
    setPriceCents(String(variant.price_cents));
    setInventoryCount(String(variant.inventory_count));
    setError("");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError("");
  };

  const handleSave = async () => {
    const price = Number(priceCents);
    const inv = Number(inventoryCount);

    if (isNaN(price) || price < 0) {
      setError("Price must be >= 0");
      return;
    }
    if (isNaN(inv) || inv < 0) {
      setError("Inventory must be >= 0");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await updateVariant(variant.id, {
        price_cents: price,
        inventory_count: inv,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Update failed");
        return;
      }
      const updated = await res.json();
      onUpdated(updated);
      setIsEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "h-8 w-24 rounded border border-input bg-background px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <>
      <tr className="border-b transition-colors hover:bg-muted/50">
        <td className="p-4 align-middle font-mono text-xs">
          {variant.sku}
        </td>
        <td className="p-4 align-middle font-medium">{variant.name}</td>
        <td className="p-4 text-right align-middle tabular-nums">
          {isEditing ? (
            <input
              type="number"
              min="0"
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          ) : (
            formatPrice(variant.price_cents)
          )}
        </td>
        <td className="p-4 text-right align-middle tabular-nums">
          {isEditing ? (
            <input
              type="number"
              min="0"
              value={inventoryCount}
              onChange={(e) => setInventoryCount(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          ) : (
            <span
              className={cn(
                outOfStock && "text-destructive",
                lowStock && "text-amber-600"
              )}
            >
              {variant.inventory_count}
              {outOfStock && (
                <Package className="ml-1 inline h-3.5 w-3.5 text-destructive/60" />
              )}
            </span>
          )}
        </td>
        <td className="p-4 text-right align-middle">
          {isEditing ? (
            <div className="inline-flex gap-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={startEdit}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </td>
      </tr>
      {error && isEditing && (
        <tr>
          <td colSpan={5} className="px-4 pb-2 text-xs text-destructive">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
