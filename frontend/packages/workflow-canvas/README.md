# Workflow Canvas

A React component library for building workflow editors based on Flowgram.AI.

## Installation

```bash
npm install workflow-canvas
# or
yarn add workflow-canvas
```

## Quick Start

```tsx
import React from 'react';
import { WorkflowCanvas } from 'workflow-canvas';

// 导入必要的样式
import '@flowgram.ai/free-layout-editor/index.css';
import 'workflow-canvas/styles/index.css';

function App() {
  return (
    <WorkflowCanvas
      workflowId="your-workflow-id"
      onSave={(data) => {
        console.log('Workflow saved:', data);
      }}
    />
  );
}
```

## Features

- 🎨 **Visual Workflow Editor**: Drag-and-drop workflow builder
- 🔧 **Customizable Nodes**: Support for various node types (LLM, HTTP, Code, etc.)
- 📝 **Form System**: Rich form components for node configuration
- 🔗 **Connection Management**: Visual connection lines with validation
- 🎯 **Real-time Preview**: Test workflows directly in the editor
- 📦 **Export/Import**: Save and load workflow configurations
- 🎨 **Theming**: Customizable styling and themes
- 🔌 **Plugin System**: Extensible plugin architecture

## Core Dependencies

- **@flowgram.ai/free-layout-editor**: Core workflow editor
- **@flowgram.ai/form-materials**: Form components and materials
- **@flowgram.ai/minimap-plugin**: Minimap navigation
- **@flowgram.ai/free-snap-plugin**: Auto-alignment and guide-lines
- **@flowgram.ai/free-lines-plugin**: Connection line rendering
- **@flowgram.ai/free-node-panel-plugin**: Node add panel
- **@flowgram.ai/free-container-plugin**: Container nodes
- **@flowgram.ai/free-group-plugin**: Node grouping
- **@flowgram.ai/runtime-interface**: Runtime interfaces
- **@flowgram.ai/runtime-js**: JS runtime module

## Styling

### Required Styles

The library requires certain styles to be imported for proper functionality:

```tsx
// 1. Flowgram editor styles (required)
import '@flowgram.ai/free-layout-editor/index.css';

// 2. Workflow canvas styles (required)
import 'workflow-canvas/styles/index.css';
```

### Optional Styles

You can also import specific component styles if needed:

```tsx
// Form components
import 'workflow-canvas/components/form-components/form-item/index.css';

// Group components
import 'workflow-canvas/components/group/index.css';

// Comment components
import 'workflow-canvas/components/comment/components/index.css';
```

## API Reference

### WorkflowCanvas Component

The main component for rendering the workflow editor.

#### Props

```tsx
interface WorkflowCanvasProps {
  /** Workflow ID for loading/saving */
  workflowId?: string;
  /** Space ID for multi-tenant support */
  spaceId?: string;
  /** Initial workflow data */
  initialData?: FlowDocumentJSON;
  /** Callback when workflow is saved */
  onSave?: (data: any) => void;
  /** Callback when workflow is exported */
  onExport?: (data: any) => void;
  /** Callback when workflow is imported */
  onImport?: (data: any) => void;
    /** Custom node registries */
  nodeRegistries?: FlowNodeRegistry[];
  /** Custom plugins */
  plugins?: Plugin[];
  /** Custom styling */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}
```

#### Example

```tsx
import { WorkflowCanvas } from 'workflow-canvas';

function MyWorkflowEditor() {
  const handleSave = async (workflowData) => {
    try {
      await saveWorkflowToBackend(workflowData);
      console.log('Workflow saved successfully');
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const handleExport = (workflowData) => {
    const dataStr = JSON.stringify(workflowData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workflow.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <WorkflowCanvas
      workflowId="my-workflow-123"
      spaceId="default"
      onSave={handleSave}
      onExport={handleExport}
      style={{ height: '100vh' }}
    />
  );
}
```

### Node Types

The library supports various node types out of the box:

```tsx
import { WorkflowNodeType } from 'workflow-canvas';

// Available node types
WorkflowNodeType.Start      // Start node
WorkflowNodeType.End        // End node
WorkflowNodeType.LLM        // Large language model node
WorkflowNodeType.HTTP       // HTTP request node
WorkflowNodeType.Code       // Code execution node
WorkflowNodeType.Variable   // Variable node
WorkflowNodeType.Condition  // Conditional node
WorkflowNodeType.Loop       // Loop node
WorkflowNodeType.Comment    // Comment node
WorkflowNodeType.Continue   // Continue node
WorkflowNodeType.Break      // Break node
```

### Custom Nodes

You can create custom nodes by extending the node registry:

```tsx
import { FlowNodeRegistry, WorkflowNodeType } from 'workflow-canvas';

const CustomNodeRegistry: FlowNodeRegistry = {
  type: 'custom-node',
  info: {
    icon: <CustomIcon />,
    description: 'My custom node',
  },
  meta: {
    size: { width: 400, height: 300 },
    nodePanelVisible: true,
  },
  formMeta: {
    render: (props) => <CustomForm {...props} />,
  },
  onAdd() {
    return {
      id: `custom_${nanoid(5)}`,
      type: 'custom-node',
      data: {
        title: 'Custom Node',
        // Custom data structure
      },
    };
  },
};
```

### Form Components

The library provides a rich set of form components:

```tsx
import { 
  FormHeader, 
  FormContent, 
  VariableSelector,
  DisplayOutputs 
} from 'workflow-canvas';

function CustomForm(props) {
  return (
    <>
      <FormHeader />
      <FormContent>
        <VariableSelector
          value={fieldValue}
          onChange={handleChange}
          scope={availableVariables}
        />
        <DisplayOutputs displayFromScope />
      </FormContent>
    </>
  );
}
```

## Development

### Type Checking

```bash
# Type checking
npm run type-check

# Linting
npm run lint
```

### Project Structure

```
src/
├── editor.tsx               # Main editor component
├── index.ts                 # Library exports
├── components/              # UI components
├── nodes/                   # Node definitions
├── hooks/                   # React hooks
├── typings/                 # TypeScript types
├── styles/                  # Styles
└── utils/                   # Utility functions
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For support and questions, please open an issue on GitHub.

