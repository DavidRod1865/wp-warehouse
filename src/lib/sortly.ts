import type { SortlyItem } from "../types/sortly";

const SORTLY_API_BASE = "https://api.sortly.com/api/v1";

export const sortlyClient = {
  async listItems(params?: {
    parent_id?: number;
    per_page?: number;
    page?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.parent_id !== undefined)
      queryParams.append("parent_id", params.parent_id.toString());
    if (params?.per_page)
      queryParams.append("per_page", params.per_page.toString());
    if (params?.page) queryParams.append("page", params.page.toString());

    const response = await fetch(
      `${SORTLY_API_BASE}/items?${queryParams.toString()}&include=photos%2Ccustom_attributes`,
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Sortly API error: ${response.statusText}`);
    }

    return response.json();
  },

  async getItem(id: number) {
    const response = await fetch(
      `${SORTLY_API_BASE}/items/${id}?include=photos%2Ccustom_attributes`,
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Sortly API error: ${response.statusText}`);
    }

    return response.json();
  },

  async createItem(options: {
    name: string;
    quantity: number;
    parent_id: number;
  }) {
    const response = await fetch(`${SORTLY_API_BASE}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: options.name,
        quantity: options.quantity,
        parent_id: options.parent_id,
        type: "item",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  },

  async deleteItem(itemId: number) {
    const response = await fetch(`${SORTLY_API_BASE}/items/${itemId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.statusText} - ${errorText}`
      );
    }

    if (response.status === 204) {
      return { success: true };
    }

    return response.json();
  },

  /**
   * Copy item to destination folder (keep original in source)
   * Use for: Warehouse → Truck (items stay in warehouse)
   */
  async copyItem(itemId: number, quantity: number, toFolderId: number) {
    const response = await fetch(`${SORTLY_API_BASE}/items/${itemId}/move`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quantity: quantity,
        folder_id: toFolderId,
        leave_zero_quantity: true, // Keep original
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  },

  /**
   * Move item to destination folder (remove from source if quantity reaches zero)
   * Use for: Truck → Job Site, removing items from truck
   */
  async moveItem(itemId: number, quantity: number, toFolderId: number) {
    const response = await fetch(`${SORTLY_API_BASE}/items/${itemId}/move`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quantity: quantity,
        folder_id: toFolderId,
        leave_zero_quantity: false, // Remove from source
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  },

  /**
   * Move item quantity from source to destination
   * @param leaveZeroInSource - If true, keeps item in source even if quantity becomes 0
   */
  async moveItemWithOptions(
    itemId: number,
    quantity: number,
    toFolderId: number,
    leaveZeroInSource: boolean
  ) {
    const response = await fetch(`${SORTLY_API_BASE}/items/${itemId}/move`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quantity: quantity,
        folder_id: toFolderId,
        leave_zero_quantity: leaveZeroInSource,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  },

  async updateItem(itemId: number, updates: Partial<SortlyItem>) {
    const response = await fetch(`${SORTLY_API_BASE}/items/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.statusText} - ${errorText}`
      );
    }

    // Sortly PUT returns 204 No Content on success
    if (response.status === 204) {
      return { success: true };
    }

    return response.json();
  },

  async deleteItem(itemId: number) {
    const response = await fetch(`${SORTLY_API_BASE}/items/${itemId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SORTLY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sortly API error: ${response.statusText} - ${errorText}`
      );
    }

    // DELETE typically returns 204 No Content on success
    if (response.status === 204) {
      return { success: true };
    }

    return response.json();
  },

  async findItemInFolder(
    _originalItemId: number,
    itemName: string,
    folderId: number
  ) {
    try {
      const allItems: SortlyItem[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.listItems({
          parent_id: folderId,
          per_page: 100,
          page,
        });
        if (response.data && response.data.length > 0) {
          allItems.push(...response.data);
          hasMore = response.data.length === 100;
          page++;
        } else {
          hasMore = false;
        }
      }

      const item = allItems.find(
        (i: SortlyItem) =>
          i.name.trim().toLowerCase() === itemName.trim().toLowerCase() &&
          i.parent_id === folderId
      );

      if (!item) {
        console.warn(`Item "${itemName}" not found in folder ${folderId}`);
      }

      return item;
    } catch (error) {
      console.error("Failed to find item in folder:", error);
      return null;
    }
  },

  async addDeliveryNote(
    itemId: number,
    _folderId: number,
    deliveryNumber: string
  ) {
    try {
      const itemData = await this.getItem(itemId);
      const item = itemData.data;

      if (!item) {
        console.warn(`Item ${itemId} not found`);
        return;
      }

      const currentNotes = item.notes || "";
      const deliveryNote = `[Delivery: ${deliveryNumber}]`;

      if (!currentNotes.includes(deliveryNote)) {
        const updatedNotes = currentNotes
          ? `${currentNotes}\n${deliveryNote}`
          : deliveryNote;
        await this.updateItem(itemId, { notes: updatedNotes });
      }
    } catch (error) {
      console.error("Failed to add delivery note:", error);
    }
  },

  async removeDeliveryNote(itemId: number, deliveryNumber: string) {
    try {
      const itemData = await this.getItem(itemId);
      const item = itemData.data;

      if (!item) {
        console.warn(`Item ${itemId} not found`);
        return;
      }

      const currentNotes = item.notes || "";
      const deliveryNote = `[Delivery: ${deliveryNumber}]`;

      if (currentNotes.includes(deliveryNote)) {
        const updatedNotes = currentNotes
          .replace(`\n${deliveryNote}`, "")
          .replace(deliveryNote, "")
          .trim();
        await this.updateItem(itemId, { notes: updatedNotes });
      }
    } catch (error) {
      console.error("Failed to remove delivery note:", error);
    }
  },
};
