// This script injects Tailwind CSS into the page for content scripts

function injectTailwindCSS() {
  // Check if Tailwind is already loaded
  if (document.querySelector('#movsy-tailwind-script')) {
    return;
  }
  
  // Create script element
  const script = document.createElement('script');
  script.id = 'movsy-tailwind-script';
  script.src = 'https://cdn.tailwindcss.com';
  
  // Add configuration
  script.onload = () => {
    // Add Tailwind config when script loads
    const configScript = document.createElement('script');
    configScript.textContent = `
      if (window.tailwind) {
        window.tailwind.config = {
          prefix: 'vs-', // Prevent conflicts with page styles
          content: [],
          theme: {
            extend: {
              colors: {
                'apple-dark': '#1c1c1e',
                'apple-darker': '#121214',
              },
              boxShadow: {
                'glow-green': '0 0 5px rgba(52, 211, 153, 0.5)',
                'glow-red': '0 0 5px rgba(239, 68, 68, 0.5)',
              }
            }
          },
          corePlugins: {
            preflight: false, // Don't reset page styles
          }
        }
      }
    `;
    document.head.appendChild(configScript);
    
    // Dispatch event when Tailwind is ready
    const event = new CustomEvent('tailwind-ready');
    document.dispatchEvent(event);
  };
  
  document.head.appendChild(script);
}

// Inject Tailwind
injectTailwindCSS();

console.log('Tailwind CSS injector loaded');
