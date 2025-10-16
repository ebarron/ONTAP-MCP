package tools

// TextContent creates a text content item
func TextContent(text string) Content {
	return Content{
		Type: "text",
		Text: text,
	}
}

// ErrorContent creates an error text content item
func ErrorContent(errMsg string) Content {
	return Content{
		Type: "text",
		Text: errMsg,
	}
}
