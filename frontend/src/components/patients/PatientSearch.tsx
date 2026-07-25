import React from "react";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";

export type SortOption = "newest" | "last_visit" | "highest_risk" | "alphabetical" | "upcoming_followup";

interface PatientSearchProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  sortBy: SortOption;
  onSortChange: (val: SortOption) => void;
  className?: string;
}

export const PatientSearch: React.FC<PatientSearchProps> = ({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  className
}) => {
  return (
    <div className={`flex flex-col md:flex-row gap-3 ${className || ""}`}>
      {/* Search Input Box */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          placeholder="Search by name, phone (+91), chief complaint, ICD-10 code, or date..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700/70 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-500"
        />
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="bg-slate-800 border border-slate-700/70 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-teal-500"
        >
          <option value="newest">Newest Added</option>
          <option value="last_visit">Recent Last Visit</option>
          <option value="highest_risk">Highest Risk First</option>
          <option value="alphabetical">Alphabetical (A-Z)</option>
          <option value="upcoming_followup">Upcoming Follow-up</option>
        </select>
      </div>
    </div>
  );
};
