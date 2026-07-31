/**
 * Pure helpers for parsing and merging view layoutxml / fetchxml.
 *
 * Design rules honored here:
 *  - Filters are NEVER copied between views. Sort order and columns are merged
 *    into the target fetchxml while leaving every <filter> of the target untouched.
 *  - Link-entities copied from the source (needed for aliased layout columns)
 *    have their <filter> and <order> children stripped before insertion.
 */

export interface LayoutColumn {
    /** attribute logical name, or "alias.attribute" for linked columns */
    name: string;
    width: number;
    isHidden: boolean;
}

export interface SortOrder {
    attribute: string;
    descending: boolean;
    /** entityname attribute (link-entity alias) when sorting on a linked column */
    entityAlias?: string;
}

export interface FetchMergeResult {
    fetchXml: string;
    changed: boolean;
    addedAttributes: string[];
    addedLinkEntities: string[];
    /** orders that could not be applied because their link-entity alias is missing in the target */
    droppedOrders: string[];
}

function parseXml(xml: string): Document {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Invalid XML");
    }
    return doc;
}

function serializeXml(doc: Document): string {
    return new XMLSerializer().serializeToString(doc);
}

function directChildren(parent: Element, tagName: string): Element[] {
    return Array.from(parent.children).filter((c) => c.tagName === tagName);
}

function getRootEntity(doc: Document): Element {
    const fetch = doc.documentElement;
    const entity = directChildren(fetch, "entity")[0];
    if (!entity) {
        throw new Error("fetchxml has no <entity> element");
    }
    return entity;
}

/** Parse the visible/hidden columns of a view's layoutxml, in display order. */
export function parseLayoutColumns(layoutXml: string): LayoutColumn[] {
    const doc = parseXml(layoutXml);
    const cells = Array.from(doc.getElementsByTagName("cell"));
    return cells.map((cell) => ({
        name: cell.getAttribute("name") ?? "",
        width: parseInt(cell.getAttribute("width") ?? "100", 10) || 100,
        isHidden: cell.getAttribute("ishidden") === "1",
    }));
}

/** Parse sort orders from a view's fetchxml (root-entity orders plus orders nested in link-entities). */
export function parseSortOrders(fetchXml: string): SortOrder[] {
    const doc = parseXml(fetchXml);
    const entity = getRootEntity(doc);
    const orders: SortOrder[] = [];

    for (const order of directChildren(entity, "order")) {
        orders.push({
            attribute: order.getAttribute("attribute") ?? "",
            descending: order.getAttribute("descending") === "true",
            entityAlias: order.getAttribute("entityname") ?? undefined,
        });
    }

    for (const link of Array.from(entity.getElementsByTagName("link-entity"))) {
        for (const order of directChildren(link, "order")) {
            orders.push({
                attribute: order.getAttribute("attribute") ?? "",
                descending: order.getAttribute("descending") === "true",
                entityAlias: link.getAttribute("alias") ?? undefined,
            });
        }
    }

    return orders;
}

/**
 * Build the target's new layoutxml: the source row's cells (the column definitions)
 * replace the target's, while the target keeps its own <grid> and <row> attributes.
 * Those attributes differ between view types and include metadata required by
 * special-purpose views such as Quick Find.
 */
export function buildTargetLayoutXml(sourceLayoutXml: string, targetLayoutXml: string): string {
    const sourceDoc = parseXml(sourceLayoutXml);
    const targetDoc = parseXml(targetLayoutXml);

    const sourceGrid = sourceDoc.getElementsByTagName("grid")[0];
    const targetGrid = targetDoc.getElementsByTagName("grid")[0];
    if (!sourceGrid || !targetGrid) {
        throw new Error("layoutxml has no <grid> element");
    }

    const sourceRow = directChildren(sourceGrid, "row")[0];
    const targetRow = directChildren(targetGrid, "row")[0];
    if (!sourceRow || !targetRow) {
        throw new Error("layoutxml has no <row> element");
    }

    while (targetRow.firstChild) {
        targetRow.removeChild(targetRow.firstChild);
    }
    for (const cell of directChildren(sourceRow, "cell")) {
        targetRow.appendChild(targetDoc.importNode(cell, true));
    }

    return serializeXml(targetDoc);
}

function findLinkEntityByAlias(scope: Element, alias: string): Element | undefined {
    return Array.from(scope.getElementsByTagName("link-entity")).find((le) => le.getAttribute("alias") === alias);
}

function ensureAttribute(doc: Document, parent: Element, name: string, added: string[], addedLabel: string): void {
    const exists = directChildren(parent, "attribute").some((a) => a.getAttribute("name") === name);
    const isAllAttributes = directChildren(parent, "all-attributes").length > 0;
    if (exists || isAllAttributes) {
        return;
    }
    const attr = doc.createElement("attribute");
    attr.setAttribute("name", name);
    parent.insertBefore(attr, parent.firstChild);
    added.push(addedLabel);
}

/**
 * Merge the pieces of the source fetchxml that the copied layout needs into the
 * target fetchxml, without ever touching the target's filters.
 *
 * - requiredColumns: layout cell names; missing <attribute> nodes (and missing
 *   link-entities for aliased columns) are added. Link-entities cloned from the
 *   source are stripped of their <filter>/<order> children.
 * - copySortOrder: target's <order> elements are replaced with the source's.
 */
export function mergeFetchXml(sourceFetchXml: string, targetFetchXml: string, requiredColumns: string[], copySortOrder: boolean): FetchMergeResult {
    const sourceDoc = parseXml(sourceFetchXml);
    const targetDoc = parseXml(targetFetchXml);
    const sourceEntity = getRootEntity(sourceDoc);
    const targetEntity = getRootEntity(targetDoc);

    const addedAttributes: string[] = [];
    const addedLinkEntities: string[] = [];
    const droppedOrders: string[] = [];

    for (const column of requiredColumns) {
        if (!column) continue;

        const dotIndex = column.indexOf(".");
        if (dotIndex === -1) {
            ensureAttribute(targetDoc, targetEntity, column, addedAttributes, column);
            continue;
        }

        // Aliased column from a link-entity, e.g. "primarycontact.emailaddress1"
        const alias = column.substring(0, dotIndex);
        const attribute = column.substring(dotIndex + 1);

        let targetLink = findLinkEntityByAlias(targetEntity, alias);
        if (!targetLink) {
            const sourceLink = findLinkEntityByAlias(sourceEntity, alias);
            if (!sourceLink) {
                // Source layout references an alias its own fetchxml doesn't define; nothing we can do.
                continue;
            }
            const clone = targetDoc.importNode(sourceLink, true) as Element;
            // Filters are intentionally not copied between views; orders are handled separately.
            for (const tag of ["filter", "order"]) {
                for (const el of Array.from(clone.getElementsByTagName(tag))) {
                    el.parentNode?.removeChild(el);
                }
            }
            targetEntity.appendChild(clone);
            targetLink = clone;
            addedLinkEntities.push(alias);
        }
        ensureAttribute(targetDoc, targetLink, attribute, addedAttributes, column);
    }

    if (copySortOrder) {
        // Remove every existing order in the target (root entity and link-entities)
        for (const order of directChildren(targetEntity, "order")) {
            targetEntity.removeChild(order);
        }
        for (const link of Array.from(targetEntity.getElementsByTagName("link-entity"))) {
            for (const order of directChildren(link, "order")) {
                link.removeChild(order);
            }
        }

        // Copy root-entity orders from the source
        for (const order of directChildren(sourceEntity, "order")) {
            const entityAlias = order.getAttribute("entityname");
            if (entityAlias && !findLinkEntityByAlias(targetEntity, entityAlias)) {
                droppedOrders.push(`${entityAlias}.${order.getAttribute("attribute") ?? ""}`);
                continue;
            }
            targetEntity.appendChild(targetDoc.importNode(order, true));
        }

        // Copy orders nested inside source link-entities into the matching target link-entity
        for (const link of Array.from(sourceEntity.getElementsByTagName("link-entity"))) {
            const alias = link.getAttribute("alias");
            for (const order of directChildren(link, "order")) {
                const targetLink = alias ? findLinkEntityByAlias(targetEntity, alias) : undefined;
                if (targetLink) {
                    targetLink.appendChild(targetDoc.importNode(order, true));
                } else {
                    droppedOrders.push(`${alias ?? "?"}.${order.getAttribute("attribute") ?? ""}`);
                }
            }
        }
    }

    return {
        fetchXml: serializeXml(targetDoc),
        changed: copySortOrder || addedAttributes.length > 0 || addedLinkEntities.length > 0,
        addedAttributes,
        addedLinkEntities,
        droppedOrders,
    };
}
