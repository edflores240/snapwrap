/**
 * A template's slots show photos taken in the booth. By default slot N shows shot N, but a slot can
 * carry its own `photo` number: reorder the shots by renumbering, or give two slots the same number so one
 * shot fills both (strip layouts printed twice on one sheet).
 */
interface SlotLike { photo?: number }

/** Slot indexes grouped by shot, in shot order. Every group is filled by a single capture. */
export function shotGroups(slots: SlotLike[] | undefined): number[][] {
    const byShot = new Map<number, number[]>();
    (slots || []).forEach((slot, i) => {
        const shot = slot.photo && slot.photo > 0 ? slot.photo : i + 1;
        byShot.set(shot, [...(byShot.get(shot) || []), i]);
    });
    return [...byShot.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => group);
}

/** The group a slot belongs to */
export function groupOfSlot(groups: number[][], index: number): number[] {
    return groups.find(g => g.includes(index)) || [index];
}
