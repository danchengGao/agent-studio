import { useState, MouseEvent } from 'react'
import { Menu, MenuItem } from '@mui/material'
import { Plus } from 'lucide-react'

// 通用的添加按钮组件
const AddButton = ({
  onSelect,
  options = [
    { label: '添加已有', value: 'existing' },
    { label: '创建新的', value: 'new' },
  ],
  disabled = false,
}: {
  onSelect: (addType: string) => void
  options?: Array<{ label: string; value: string }>
  disabled?: boolean
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation() // 阻止事件冒泡到Accordion
    if (!disabled) {
      setAnchorEl(event.currentTarget)
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  return (
    <>
      <div
        className={`p-1 rounded-full flex items-center justify-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-100'}`}
        onClick={handleClick}
        aria-disabled={disabled}
      >
        <Plus className="w-4 h-4 text-gray-600" />
      </div>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={e => e.stopPropagation()}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.15))',
            mt: 1,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {options.map((option, index) => (
          <MenuItem
            key={index}
            onClick={() => {
              if (!disabled) {
                onSelect(option.value)
                handleClose()
              }
            }}
            disabled={disabled}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default AddButton