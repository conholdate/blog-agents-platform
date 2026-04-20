export const DOMAINS: Record<string, string> = {
  "blog.aspose.com": process.env.SHEET_ID_ASPOSE_COM ?? "",
  "blog.aspose.cloud": process.env.SHEET_ID_ASPOSE_CLOUD ?? "",
  "blog.groupdocs.com": process.env.SHEET_ID_GROUPDOCS_COM ?? "",
  "blog.groupdocs.cloud": process.env.SHEET_ID_GROUPDOCS_CLOUD ?? "",
  "blog.conholdate.com": process.env.SHEET_ID_CONHOLDATE_COM ?? "",
  "blog.conholdate.cloud": process.env.SHEET_ID_CONHOLDATE_CLOUD ?? "",
};

export const DOMAIN_LABELS: Record<string, { label: string; color: string; brandColor: string }> = {
  "blog.aspose.com":        { label: "Aspose",            color: "bg-blue-600",   brandColor: "#3387CC" },
  "blog.aspose.cloud":      { label: "Aspose Cloud",      color: "bg-blue-400",   brandColor: "#5BA3DC" },
  "blog.groupdocs.com":     { label: "GroupDocs",         color: "bg-green-600",  brandColor: "#34A853" },
  "blog.groupdocs.cloud":   { label: "GroupDocs Cloud",   color: "bg-green-400",  brandColor: "#5DC274" },
  "blog.conholdate.com":    { label: "Conholdate",        color: "bg-orange-500", brandColor: "#E8702A" },
  "blog.conholdate.cloud":  { label: "Conholdate Cloud",  color: "bg-purple-400", brandColor: "#7B3FBE" },
};

export const STATUS_OPTIONS = ["ok", "pending", "rejected"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];
