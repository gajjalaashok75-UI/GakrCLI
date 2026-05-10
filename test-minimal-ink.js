#!/usr/bin/env node

// Minimal test to see if Ink works on Windows
console.log('Testing minimal Ink on Windows...');

async function testInk() {
  try {
    // Import the createRoot function from the correct location
    const { createRoot } = await import('./src/ink.ts');
    console.log('✓ Successfully imported createRoot');
    
    // Try to create a root
    const root = await createRoot({
      exitOnCtrlC: false,
      patchConsole: false
    });
    console.log('✓ Successfully created root');
    
    // Try to render something simple
    const React = (await import('react')).default;
    const { Text } = await import('./src/ink.ts');
    
    console.log('✓ About to render...');
    root.render(React.createElement(Text, {}, 'Hello from Ink!'));
    console.log('✓ Rendered successfully');
    
    // Wait a bit then exit
    setTimeout(() => {
      console.log('✓ Exiting...');
      root.unmount();
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  }
}

testInk();