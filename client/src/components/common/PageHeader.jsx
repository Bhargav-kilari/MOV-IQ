import React from 'react';

export const PageHeader = ({ title, subtitle, action, breadcrumb }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
      <div>
        {breadcrumb && (
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111111] uppercase">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[#6B7280] mt-0.5 max-w-xl">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export default PageHeader;
