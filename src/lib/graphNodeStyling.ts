export const VEHICLE_MODEL_NODE_COLOR = "#38BDF8";

function normalizeNodeType(type: string) {
  return type.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function isVehicleModelType(type: string) {
  return normalizeNodeType(type) === "vehiclemodel";
}
