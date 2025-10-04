import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    console.log('NavigationService: Navigating to', name, 'with params:', params);
    try {
      navigationRef.navigate(name, params);
      console.log('NavigationService: Navigation command sent successfully');
    } catch (error) {
      console.error('NavigationService: Error during navigation:', error);
    }
  } else {
    console.error('NavigationService: Navigation not ready');
  }
}

export function goBack() {
  if (navigationRef.isReady()) {
    navigationRef.goBack();
  }
}

export function reset(routeName, params) {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: routeName, params }],
    });
  }
}
