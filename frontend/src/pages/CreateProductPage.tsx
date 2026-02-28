import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createProduct, fetchCategories } from "@/lib/api";
import type { Category } from "@/types";

interface VariantForm {
  sku: string;
  name: string;
  price_cents: string;
  inventory_count: string;
}

const emptyVariant = (): VariantForm => ({
  sku: "",
  name: "",
  price_cents: "",
  inventory_count: "",
});

export default function CreateProductPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);

  // Product fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("active");

  // Variants
  const [variants, setVariants] = useState<VariantForm[]>([emptyVariant()]);

  // Form state
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const updateVariant = (index: number, field: keyof VariantForm, value: string) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const addVariant = () => setVariants((prev) => [...prev, emptyVariant()]);

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Product name is required.";
    if (variants.length === 0) return "At least one variant is required.";
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.sku.trim()) return `Variant ${i + 1}: SKU is required.`;
      if (!v.name.trim()) return `Variant ${i + 1}: Name is required.`;
      const price = Number(v.price_cents);
      if (v.price_cents !== "" && (isNaN(price) || price < 0))
        return `Variant ${i + 1}: Price must be >= 0.`;
      const inv = Number(v.inventory_count);
      if (v.inventory_count !== "" && (isNaN(inv) || inv < 0))
        return `Variant ${i + 1}: Inventory count must be >= 0.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
        status,
        variants: variants.map((v) => ({
          sku: v.sku.trim(),
          name: v.name.trim(),
          price_cents: v.price_cents !== "" ? Number(v.price_cents) : 0,
          inventory_count: v.inventory_count !== "" ? Number(v.inventory_count) : 0,
        })),
      };

      const res = await createProduct(body);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create product");
        return;
      }

      const created = await res.json();
      navigate(`/products/${created.id}`);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div>
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        Create New Product
      </h1>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product info card */}
        <div className="rounded-lg border bg-card p-6 shadow-card space-y-4">
          <h2 className="text-lg font-semibold">Product Information</h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Variants card */}
        <div className="rounded-lg border bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Variants <span className="text-destructive">*</span>
            </h2>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Add Variant
            </button>
          </div>

          {variants.map((v, i) => (
            <div
              key={i}
              className="rounded-md border bg-background p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Variant {i + 1}
                </span>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    SKU <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={v.sku}
                    onChange={(e) => updateVariant(i, "sku", e.target.value)}
                    placeholder="e.g. SKU-001"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={v.name}
                    onChange={(e) => updateVariant(i, "name", e.target.value)}
                    placeholder="e.g. Default"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Price (cents)</label>
                  <input
                    type="number"
                    min="0"
                    value={v.price_cents}
                    onChange={(e) => updateVariant(i, "price_cents", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Inventory Count</label>
                  <input
                    type="number"
                    min="0"
                    value={v.inventory_count}
                    onChange={(e) => updateVariant(i, "inventory_count", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#2E3330] px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a3f3c] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating…" : "Create Product"}
          </button>
          <Link
            to="/products"
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
