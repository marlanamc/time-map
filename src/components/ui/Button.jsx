import React from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader } from 'react-icons/fi';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantStyles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-200',
    outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-200',
  };

  const widthStyles = fullWidth ? 'w-full' : '';
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      type={type}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyles} ${className}`}
      disabled={isDisabled}
      onClick={onClick}
      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
      whileHover={isDisabled ? {} : { scale: 1.02 }}
      transition={{ duration: 0.1 }}
      {...props}
    >
      <AnimatePresence>
        {isLoading && (
          <motion.span
            className="mr-2"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
          >
            <FiLoader className="animate-spin" />
          </motion.span>
        )}
      </AnimatePresence>
      
      {LeftIcon && !isLoading && (
        <LeftIcon className="mr-2" size={size === 'sm' ? 16 : 20} />
      )}
      
      <span>{children}</span>
      
      {RightIcon && !isLoading && (
        <RightIcon className="ml-2" size={size === 'sm' ? 16 : 20} />
      )}
    </motion.button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost', 'outline']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.elementType,
  rightIcon: PropTypes.elementType,
  className: PropTypes.string,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export default Button;
