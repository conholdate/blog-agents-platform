export const DOMAINS: Record<string, string> = {
  "blog.aspose.com": process.env.KEYWORD_AGENT_SHEET_ID_ASPOSE_COM ?? "",
  "blog.aspose.cloud": process.env.KEYWORD_AGENT_SHEET_ID_ASPOSE_CLOUD ?? "",
  "blog.groupdocs.com": process.env.KEYWORD_AGENT_SHEET_ID_GROUPDOCS_COM ?? "",
  "blog.groupdocs.cloud": process.env.KEYWORD_AGENT_SHEET_ID_GROUPDOCS_CLOUD ?? "",
  "blog.conholdate.com": process.env.KEYWORD_AGENT_SHEET_ID_CONHOLDATE_COM ?? "",
  "blog.conholdate.cloud": process.env.KEYWORD_AGENT_SHEET_ID_CONHOLDATE_CLOUD ?? "",
};

export const OPTIMIZATION_SHEET_ID_QUEUE = process.env.SHEET_ID_TO_BE_OPTIMIZED ?? "";
export const OPTIMIZATION_SHEET_ID_LOG   = process.env.SHEET_ID_OPTIMIZATION_LOG ?? "";

export const TRANSLATION_SHEET_ID = process.env.TRANSLATION_SCAN_SHEET_ID ?? "";

// Maps URL path segment (lowercase) → display name
export const PRODUCT_LABELS: Record<string, string> = {
  "3d":        "3D",
  "barcode":   "BarCode",
  "cad":       "CAD",
  "gis":       "GIS",
  "html":      "HTML",
  "ocr":       "OCR",
  "omr":       "OMR",
  "pdf":       "PDF",
  "psd":       "PSD",
  "pub":       "PUB",
  "svg":       "SVG",
  "tex":       "TeX",
  "zip":       "ZIP",
};

export const DOMAIN_LABELS: Record<string, { label: string; color: string; brandColor: string; logo: string }> = {
  "blog.aspose.com":        { label: "Aspose",            color: "bg-blue-600",   brandColor: "#3387CC", logo: "/logos/aspose.png"      },
  "blog.aspose.cloud":      { label: "Aspose Cloud",      color: "bg-blue-400",   brandColor: "#5BA3DC", logo: "/logos/aspose.png"      },
  "blog.groupdocs.com":     { label: "GroupDocs",         color: "bg-green-600",  brandColor: "#34A853", logo: "/logos/groupdocs.png"   },
  "blog.groupdocs.cloud":   { label: "GroupDocs Cloud",   color: "bg-green-400",  brandColor: "#5DC274", logo: "/logos/groupdocs.png"   },
  "blog.conholdate.com":    { label: "Conholdate",        color: "bg-orange-500", brandColor: "#E8702A", logo: "/logos/conholdate.png"  },
  "blog.conholdate.cloud":  { label: "Conholdate Cloud",  color: "bg-purple-400", brandColor: "#7B3FBE", logo: "/logos/conholdate.png"  },
};

export const STATUS_OPTIONS = ["queued", "approved", "rejected", "generated"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];

// Platform banner colors
const PLATFORM_COLORS: { match: RegExp; color: string }[] = [
  { match: /\.net|dotnet|c#|csharp/i,  color: "#512BD4" }, // .NET purple
  { match: /java(?!script)/i,           color: "#9B2335" }, // Java maroon red
  { match: /python/i,                   color: "#3776AB" }, // Python blue
  { match: /c\+\+|cpp/i,               color: "#00599C" }, // C++ blue
  { match: /node|nodejs|node\.js/i,     color: "#339933" }, // Node.js green
];

export function getPlatformColor(platform: string, fallback: string): string {
  if (!platform) return fallback;
  const match = PLATFORM_COLORS.find((p) => p.match.test(platform));
  return match ? match.color : fallback;
}
