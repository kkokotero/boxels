import { $, Fragment as FRAGMENT } from '@dom/index';

export const Fragment = ({ ...props }) => {
	return $(FRAGMENT, props);
};