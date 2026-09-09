import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

const FILE_NAME = "catering_costs.json";
const WEB_KEY = "catering-tracker-json";

export type JsonItem = {
  name: string; quantity: number; unit: string; price_per_unit: number;
  cost: number; category: string; deleted_at?: string | null;
};
export type JsonBulk = {
  id: number; supplier_id: number | null; timestamp: string; items: JsonItem[];
  total: number; deleted_at?: string | null;
};
export type CateringData = Record<string, { bulk_inputs: JsonBulk[]; day_total?: number } | Record<string, unknown>> & {
  suppliers: Record<string, { id: number; name: string; contact: string; address: string; notes: string }>;
};

export const isNativeApp = () => Capacitor.isNativePlatform();

const emptyData = (): CateringData => ({ suppliers: {} });

export async function readLocalData(): Promise<CateringData> {
  if (!isNativeApp()) {
    const saved = window.localStorage.getItem(WEB_KEY);
    return saved ? JSON.parse(saved) : emptyData();
  }

  try {
    const file = await Filesystem.readFile({ path: FILE_NAME, directory: Directory.Data, encoding: Encoding.UTF8 });
    return JSON.parse(file.data as string) as CateringData;
  } catch {
    const seed = await fetch("/seed/catering_costs.json").then((response) => response.json()) as CateringData;
    await writeLocalData(seed);
    return seed;
  }
}

export async function writeLocalData(data: CateringData) {
  const serialized = JSON.stringify(data, null, 2);
  if (!isNativeApp()) {
    window.localStorage.setItem(WEB_KEY, serialized);
    return;
  }
  await Filesystem.writeFile({ path: FILE_NAME, data: serialized, directory: Directory.Data, encoding: Encoding.UTF8 });
}
