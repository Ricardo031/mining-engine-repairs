import { Search } from 'lucide-react';
import { Input, Select } from './form';

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}

/** "" = all, "true" = active only, "false" = inactive only (same values as the API). */
export function ActiveFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Filtrar por estado"
      className="sm:w-44"
    >
      <option value="">Todos</option>
      <option value="true">Activos</option>
      <option value="false">Inactivos</option>
    </Select>
  );
}
