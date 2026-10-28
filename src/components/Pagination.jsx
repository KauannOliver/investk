import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
      <button
        className="btn btn-ghost btn-sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={{ padding: '6px 10px' }}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm fw-600 text-muted">
        Página {currentPage} de {totalPages}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        style={{ padding: '6px 10px' }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
