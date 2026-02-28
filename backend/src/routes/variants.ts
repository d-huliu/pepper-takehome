import { Router } from "express";
import db from "../db.js";

const router = Router();

/**
 * GET /api/variants/:id
 * Get a single variant.
 */
router.get("/:id", (req, res) => {
  try {
    const variant = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(Number(req.params.id));

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json(variant);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/variants/:id
 * Update a variant's price and/or inventory.
 *
 * Expected body (all fields optional):
 * {
 *   "name": "Updated Name",
 *   "sku": "NEW-SKU",
 *   "price_cents": 1999,
 *   "inventory_count": 50
 * }
 */
router.put("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, sku, price_cents, inventory_count } = req.body;

    // Check variant exists
    const existing = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      return res.status(404).json({ error: "Variant not found" });
    }

    // Validate price
    if (price_cents !== undefined && price_cents < 0) {
      return res.status(400).json({ error: "Price must be >= 0" });
    }

    // Validate inventory
    if (inventory_count !== undefined && inventory_count < 0) {
      return res.status(400).json({ error: "Inventory count must be >= 0" });
    }

    // Validate SKU uniqueness if changing
    if (sku !== undefined) {
      if (!sku || typeof sku !== "string" || sku.trim().length === 0) {
        return res.status(400).json({ error: "SKU is required" });
      }
      const duplicate = db
        .prepare("SELECT id FROM variants WHERE sku = ? AND id != ?")
        .get(sku.trim(), id);
      if (duplicate) {
        return res.status(400).json({ error: `SKU '${sku.trim()}' already exists` });
      }
    }

    db.prepare(
      `UPDATE variants
       SET name = COALESCE(?, name),
           sku = COALESCE(?, sku),
           price_cents = COALESCE(?, price_cents),
           inventory_count = COALESCE(?, inventory_count),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      name ?? null,
      sku ? sku.trim() : null,
      price_cents ?? null,
      inventory_count ?? null,
      id
    );

    const updated = db.prepare("SELECT * FROM variants WHERE id = ?").get(id);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/variants/:id
 * Delete a variant permanently.
 */
router.delete("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const variant = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    // Prevent deleting the last variant of a product
    const siblingCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM variants WHERE product_id = ?"
      )
      .get(variant.product_id as number) as { count: number };

    if (siblingCount.count <= 1) {
      return res
        .status(400)
        .json({ error: "Cannot delete the last variant of a product" });
    }

    db.prepare("DELETE FROM variants WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
