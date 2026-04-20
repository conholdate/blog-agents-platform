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
  "blog.aspose.cloud":      { label: "Aspose Cloud",      color: "bg-blue-400",   brandColor: "#3387CC" },
  "blog.groupdocs.com":     { label: "GroupDocs",         color: "bg-blue-500",   brandColor: "#4187FF" },
  "blog.groupdocs.cloud":   { label: "GroupDocs Cloud",   color: "bg-blue-400",   brandColor: "#4187FF" },
  "blog.conholdate.com":    { label: "Conholdate",        color: "bg-cyan-500",   brandColor: "#3CA3D9" },
  "blog.conholdate.cloud":  { label: "Conholdate Cloud",  color: "bg-cyan-400",   brandColor: "#3CA3D9" },
};

export const STATUS_OPTIONS = ["ok", "pending", "rejected"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];
