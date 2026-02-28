import { Router } from "express";
import db from "../db.js";

const router = Router();

/**
 * GET /api/products
 * List all products with category name, variant count, and price/inventory aggregates.
 * Supports optional query params: ?search=term&category_id=1
 */
router.get("/", (req, res) => {
  try {
    const { search, category_id } = req.query;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        c.name AS category_name,
        p.status,
        p.deleted_at,
        p.created_at,
        p.updated_at,
        COUNT(v.id) AS variant_count,
        MIN(v.price_cents) AS min_price_cents,
        MAX(v.price_cents) AS max_price_cents,
        COALESCE(SUM(v.inventory_count), 0) AS total_inventory
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN variants v ON v.product_id = p.id
    `;

    const conditions: string[] = ["p.deleted_at IS NULL"];
    const params: unknown[] = [];

    if (search) {
      conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      conditions.push("p.category_id = ?");
      params.push(Number(category_id));
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " GROUP BY p.id ORDER BY p.created_at DESC";

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/products/:id
 * Get a single product with its variants.
 */
router.get("/:id", (req, res) => {
  try {
    const product = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(Number(req.params.id)) as Record<string, unknown> | undefined;

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const variants = db
      .prepare(
        `SELECT * FROM variants WHERE product_id = ? ORDER BY created_at ASC`
      )
      .all(Number(req.params.id));

    res.json({ ...product, variants });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/products
 * Create a new product with at least one variant.
 *
 * Expected body:
 * {
 *   "name": "Product Name",
 *   "description": "Optional description",
 *   "category_id": 1,
 *   "status": "active",
 *   "variants": [
 *     { "sku": "SKU-001", "name": "Default", "price_cents": 999, "inventory_count": 10 }
 *   ]
 * }
 */
router.post("/", (req, res) => {
  try {
    const { name, description, category_id, status, variants } = req.body;

    // Validate product name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Product name is required" });
    }

    // Validate variants array
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: "At least one variant is required" });
    }

    // Validate each variant
    for (const v of variants) {
      if (!v.sku || typeof v.sku !== "string" || v.sku.trim().length === 0) {
        return res.status(400).json({ error: "Variant SKU is required" });
      }
      if (v.price_cents !== undefined && v.price_cents < 0) {
        return res.status(400).json({ error: "Price must be >= 0" });
      }
      if (v.inventory_count !== undefined && v.inventory_count < 0) {
        return res.status(400).json({ error: "Inventory count must be >= 0" });
      }
    }

    // Check for duplicate SKUs against existing data
    for (const v of variants) {
      const existing = db
        .prepare("SELECT id FROM variants WHERE sku = ?")
        .get(v.sku.trim());
      if (existing) {
        return res.status(400).json({ error: `SKU '${v.sku.trim()}' already exists` });
      }
    }

    // Insert product + variants in a transaction
    const insertProduct = db.prepare(
      `INSERT INTO products (name, description, category_id, status)
       VALUES (?, ?, ?, ?)`
    );
    const insertVariant = db.prepare(
      `INSERT INTO variants (product_id, sku, name, price_cents, inventory_count)
       VALUES (?, ?, ?, ?, ?)`
    );

    const result = db.transaction(() => {
      const productResult = insertProduct.run(
        name.trim(),
        description ?? null,
        category_id ?? null,
        status ?? "active"
      );
      const productId = Number(productResult.lastInsertRowid);

      const createdVariants = [];
      for (const v of variants) {
        const variantResult = insertVariant.run(
          productId,
          v.sku.trim(),
          v.name ?? "Default",
          v.price_cents ?? 0,
          v.inventory_count ?? 0
        );
        createdVariants.push({
          id: Number(variantResult.lastInsertRowid),
          product_id: productId,
          sku: v.sku.trim(),
          name: v.name ?? "Default",
          price_cents: v.price_cents ?? 0,
          inventory_count: v.inventory_count ?? 0,
        });
      }

      return { productId, createdVariants };
    })();

    // Fetch the full product to return
    const product = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(result.productId) as Record<string, unknown>;

    const productVariants = db
      .prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY created_at ASC")
      .all(result.productId);

    res.status(201).json({ ...product, variants: productVariants });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/products/:id
 * Update a product's basic information.
 */
router.put("/:id", (req, res) => {
  try {
    const { name, description, category_id, status } = req.body;
    const id = Number(req.params.id);

    const existing = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    db.prepare(
      `UPDATE products
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           category_id = COALESCE(?, category_id),
           status = COALESCE(?, status),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(name ?? null, description ?? null, category_id ?? null, status ?? null, id);

    const updated = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(id);

    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/products/:id
 * Soft-delete a product (sets deleted_at timestamp).
 */
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  db.prepare(
    `UPDATE products SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);

  res.json({ success: true });
});

export default router;
