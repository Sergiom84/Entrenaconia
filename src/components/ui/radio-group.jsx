import React from 'react';

export const RadioGroup = ({ value, onValueChange, children, ...props }) => {
  return (
    <div {...props}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { value, onValueChange })
      )}
    </div>
  );
};

export const RadioGroupItem = ({ value: itemValue, id, value, onValueChange, ...props }) => {
  return (
    <input
      type="radio"
      id={id}
      checked={value === itemValue}
      onChange={() => onValueChange?.(itemValue)}
      className="w-4 h-4 text-yellow-400 bg-gray-800 border-gray-600 focus:ring-yellow-400 focus:ring-2"
      {...props}
    />
  );
};
