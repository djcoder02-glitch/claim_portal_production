import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowUpDown, Filter, List, Grid, MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Claim, useDeleteClaim } from "@/hooks/useClaims";

interface ClaimsTableProps {
  claims: Claim[];
}

type SortKey = 'claim_number' | 'status' | 'created_at' | 'updated_at' | 'claim_amount';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

const statusColors: Record<string, string> = {
  draft: "rgb(107 114 128)",
  pending: "rgb(37 99 235)",
  submitted: "rgb(245 158 11)", 
  under_review: "rgb(59 130 246)",
  approved: "rgb(16 185 129)",
  rejected: "rgb(239 68 68)",
  paid: "rgb(16 185 129)",
  closed: "rgb(107 114 128)",
};

export const ClaimsTable = ({ claims }: ClaimsTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [policyTypeFilter, setPolicyTypeFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const deleteClaim = useDeleteClaim();

  // Filter and sort claims
  const filteredAndSortedClaims = useMemo(() => {
    const filtered = claims.filter(claim => {
      const matchesSearch = 
        (claim.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (claim.claim_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (claim.insured_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (claim.registration_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (claim.policy_types?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
      const matchesPolicyType = policyTypeFilter === "all" || claim.claim_type === policyTypeFilter;
      
      const matchesDateRange = (() => {
        if (!dateFromFilter && !dateToFilter) return true;
        const claimDate = new Date(claim.created_at);
        const fromDate = dateFromFilter ? new Date(dateFromFilter) : null;
        const toDate = dateToFilter ? new Date(dateToFilter) : null;
        
        if (fromDate && toDate) return claimDate >= fromDate && claimDate <= toDate;
        if (fromDate) return claimDate >= fromDate;
        if (toDate) return claimDate <= toDate;
        return true;
      })();
      
      return matchesSearch && matchesStatus && matchesPolicyType && matchesDateRange;
    });

    // Sort claims
    filtered.sort((a, b) => {
      let aValue: any = a[sortKey];
      let bValue: any = b[sortKey];

      if (sortKey === 'created_at' || sortKey === 'updated_at') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }

      if (sortKey === 'claim_amount') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      if (sortKey === 'claim_number' || sortKey === 'status') {
        aValue = (aValue || '').toString();
        bValue = (bValue || '').toString();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [claims, searchTerm, statusFilter, policyTypeFilter, dateFromFilter, dateToFilter, sortKey, sortOrder]);

  const uniquePolicyTypes = Array.from(new Set(claims.map(claim => claim.claim_type).filter(Boolean)));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const formatStatus = (status: string) => {
    if (!status) return 'Unknown';
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const uniqueStatuses = Array.from(new Set(claims.map(claim => claim.status).filter(Boolean)));

  // Shared header controls component
  const renderHeaderControls = () => (
    <div className="flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <Input 
          placeholder="Search claims..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>
                {formatStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          variant={showFilters ? "secondary" : "outline"} 
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? "Hide Filters" : "More Filters"}
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">
          Showing {filteredAndSortedClaims.length} of {claims.length} claims
        </span>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-r-none"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-l-none"
          >
            <Grid className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      {renderHeaderControls()}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Claim Type</label>
                <Select value={policyTypeFilter} onValueChange={setPolicyTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Claim Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Claim Types</SelectItem>
                    {uniquePolicyTypes.map(type => (
                      <SelectItem key={type} value={type!}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">From Date</label>
                <Input 
                  type="date" 
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">To Date</label>
                <Input 
                  type="date" 
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                />
              </div>
            </div>
            {(policyTypeFilter !== "all" || dateFromFilter || dateToFilter) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setPolicyTypeFilter("all");
                  setDateFromFilter("");
                  setDateToFilter("");
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedClaims.map((claim) => (
            <Link key={claim.id} to={`/claims/${claim.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer hover:bg-accent/50">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-sm">{claim.title || 'Untitled Claim'}</h3>
                        <p className="text-xs text-muted-foreground">#{claim.claim_number}</p>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="text-white text-xs"
                        style={{ backgroundColor: statusColors[claim.status] || statusColors.draft }}
                      >
                        {formatStatus(claim.status)}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div>Claim <Type></Type>: {claim.claim_type || 'N/A'}</div>
                      <div>Insured: {claim.insured_name || 'N/A'}</div>
                      <div>Created: {format(new Date(claim.created_at), 'MMM dd, yyyy')}</div>
                      <div>Updated: {format(new Date(claim.updated_at), 'MMM dd, yyyy')}</div>
                      {claim.intimation_date && (
                        <div>Intimation: {format(new Date(claim.intimation_date), 'MMM dd, yyyy')}</div>
                      )}
                      {claim.claim_amount && (
                        <div className="font-medium text-foreground">
                          Amount: ₹{claim.claim_amount.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim Title</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('claim_number')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Claim Number</span>
                    {getSortIcon('claim_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead>Claim Type</TableHead>
                <TableHead>Insured Name</TableHead>
                <TableHead>Assigned Surveyor</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('updated_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Last Updated</span>
                    {getSortIcon('updated_at')}
                  </div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedClaims.map((claim) => (
                <TableRow key={claim.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <Link to={`/claims/${claim.id}`} className="text-primary hover:underline">
                      {claim.title || 'Untitled Claim'}
                    </Link>
                  </TableCell>
                  <TableCell>{claim.claim_number}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className="text-white"
                      style={{ backgroundColor: statusColors[claim.status] || statusColors.draft }}
                    >
                      {formatStatus(claim.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{claim.claim_type || '-'}</TableCell>
                  <TableCell>{claim.insured_name || '-'}</TableCell>
                  <TableCell>{claim.surveyor_name || '-'}</TableCell>
                  <TableCell>{claim.insurer_name || '-'}</TableCell>
                  <TableCell>{format(new Date(claim.updated_at), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                          <Link to={`/claims/${claim.id}`}>View/Edit Claim</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this claim? This action cannot be undone.')) {
                              deleteClaim.mutate(claim.id);
                            }
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredAndSortedClaims.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No claims found matching your criteria.
            </div>
          )}
        </div>
      )}
    </div>
  );
};