import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardDrive, TrendingUp, FileText, AlertTriangle } from "lucide-react";
import { useStorageUsage, formatBytes } from "@/hooks/useStorage";
import { Progress } from "@/components/ui/progress";

export const StorageUsageDashboard = () => {
  const { data: storageData = [], isLoading } = useStorageUsage();

  if (isLoading) {
    return <div>Loading storage usage...</div>;
  }

  const totalStorage = storageData.reduce((sum, item) => sum + item.total_bytes, 0);
  const totalDocuments = storageData.reduce((sum, item) => sum + item.document_count, 0);

  // Sort by usage descending
  const sortedData = [...storageData].sort((a, b) => b.total_bytes - a.total_bytes);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalStorage)}</div>
            <p className="text-xs text-muted-foreground">
              Across {storageData.length} {storageData.length === 1 ? 'company' : 'companies'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocuments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {(totalDocuments / storageData.length || 0).toFixed(0)} avg per company
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg File Size</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(totalDocuments > 0 ? totalStorage / totalDocuments : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Per document</p>
          </CardContent>
        </Card>
      </div>

      {/* Company Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage by Company</CardTitle>
          <CardDescription>Detailed breakdown of storage consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedData.map((company, index) => {
              const percentage = totalStorage > 0 ? (company.total_bytes / totalStorage) * 100 : 0;
              const avgFileSize = company.document_count > 0 
                ? company.total_bytes / company.document_count 
                : 0;

              return (
                <div key={company.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{company.company_name || 'Unknown Company'}</p>
                        <p className="text-xs text-muted-foreground">
                          {company.document_count} documents • Avg: {formatBytes(avgFileSize)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatBytes(company.total_bytes)}</p>
                      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}

            {sortedData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No storage data available yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};