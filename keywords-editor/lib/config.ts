export const DOMAINS: Record<string, string> = {
  "blog.aspose.com": process.env.SHEET_ID_ASPOSE_COM ?? "",
  "blog.aspose.cloud": process.env.SHEET_ID_ASPOSE_CLOUD ?? "",
  "blog.groupdocs.com": process.env.SHEET_ID_GROUPDOCS_COM ?? "",
  "blog.groupdocs.cloud": process.env.SHEET_ID_GROUPDOCS_CLOUD ?? "",
  "blog.conholdate.com": process.env.SHEET_ID_CONHOLDATE_COM ?? "",
  "blog.conholdate.cloud": process.env.SHEET_ID_CONHOLDATE_CLOUD ?? "",
};

export const DOMAIN_LABELS: Record<string, { label: string; color: string }> = {
  "blog.aspose.com": { label: "Aspose", color: "bg-blue-600" },
  "blog.aspose.cloud": { label: "Aspose Cloud", color: "bg-blue-400" },
  "blog.groupdocs.com": { label: "GroupDocs", color: "bg-green-600" },
  "blog.groupdocs.cloud": { label: "GroupDocs Cloud", color: "bg-green-400" },
  "blog.conholdate.com": { label: "Conholdate", color: "bg-purple-600" },
  "blog.conholdate.cloud": { label: "Conholdate Cloud", color: "bg-purple-400" },
};

export const STATUS_OPTIONS = ["ok", "pending", "rejected"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];
