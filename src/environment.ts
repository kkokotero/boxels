export let __development__ = false;
export let __show_changes__ = false;
export let __show_comment_names__ = false;

export const enableDevelopment = () => {
	__development__ = true;
};

export const enableShowChanges = () => {
	__show_changes__ = true;
};

export const enableCommentsName = () => {
	__show_comment_names__ = true;
};
