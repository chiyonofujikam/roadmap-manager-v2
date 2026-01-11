import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export function AutocompleteInput({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Search...',
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value) {
      const selectedOption = options.find(opt => opt.value === value);
      if (selectedOption) {
        setSearchTerm(selectedOption.label);
      } else {
        // If value doesn't match any option, show the value itself
        // This handles cases where options haven't loaded yet or value is stored differently
        setSearchTerm(value);
      }
    } else {
      setSearchTerm('');
    }
  }, [value, options]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option) => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed ${label ? 'px-3 py-2' : 'px-2 py-1.5 text-sm'}`}
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {isOpen && !disabled && filteredOptions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[140px] overflow-y-auto">
          {filteredOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
