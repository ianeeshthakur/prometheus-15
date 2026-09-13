import React from 'react';
import './VariableCard.css';

function VariableCard({ name, value, description, previewStyle }) {
  return (
    <div className="variable-card">
      <div className="variable-preview" style={previewStyle}></div>
      <div className="variable-info">
        <code className="variable-name">{name}</code>
        <span className="variable-value">{value}</span>
        <p className="variable-desc">{description}</p>
      </div>
    </div>
  );
}

export default VariableCard;
