import { $ } from '@dom/index';

export const Fragment: JSX.Fragment = ({ ...props }) => {
	return $(document.createDocumentFragment(), props);
};