import { ERDEditorModel } from '../models/editor';

export interface GraphPosition {
  x: number;
  y: number;
}

export type GraphPositions = Record<string, GraphPosition>;

const NODE_WIDTH = 260;
const BASE_HEADER_HEIGHT = 58;
const ATTRIBUTE_ROW_HEIGHT = 24;
const NODE_MARGIN = 50;

export const estimateNodeHeight = (attributeCount: number): number => BASE_HEADER_HEIGHT + Math.max(1, attributeCount) * ATTRIBUTE_ROW_HEIGHT;

export const generateGridLayout = (model: ERDEditorModel): GraphPositions => {
  const positions: GraphPositions = {};
  const columns = Math.max(2, Math.ceil(Math.sqrt(model.tables.length || 1)));
  const cellWidth = NODE_WIDTH + NODE_MARGIN;
  const cellHeight = 320;

  model.tables.forEach((table, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    positions[table.id] = {
      x: NODE_MARGIN + column * cellWidth,
      y: NODE_MARGIN + row * cellHeight,
    };
  });

  return positions;
};

export const mergePositions = (current: GraphPositions, incoming: GraphPositions): GraphPositions => ({
  ...incoming,
  ...Object.fromEntries(Object.entries(current).filter(([tableId]) => tableId in incoming)),
});

export const getBounds = (model: ERDEditorModel, positions: GraphPositions) => {
  if (model.tables.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 700, width: 1000, height: 700 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const table of model.tables) {
    const position = positions[table.id];
    if (!position) continue;

    const width = NODE_WIDTH;
    const height = estimateNodeHeight(table.attributes.length);
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + width);
    maxY = Math.max(maxY, position.y + height);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return { minX, minY, maxX, maxY, width, height };
};

export const nodeWidth = NODE_WIDTH;
