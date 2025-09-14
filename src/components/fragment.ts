import { $, Fragment as FRAGMENT } from '@dom/index';

export const Fragment: JSX.Fragment = ({ ...props }) => {
	return $(FRAGMENT, props);
};